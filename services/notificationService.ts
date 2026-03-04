
import emailjs from '@emailjs/browser';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { FreightRequest, User, RequestStatus, AppNotification } from '../types';
import { userService } from './userService';

const APP_BASE_URL = 'https://freightapproval.vercel.app';
const MOCK_NOTIF_KEY = 'freightguard_notifications_mock';

export interface EmailConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  ccEmail?: string;
}

// In-memory cache to avoid repeated DB calls for the same session
let configCache: EmailConfig | null = null;
let cacheTimestamp: number | null = null;

// Helper for Mock/Local Notifications
const getLocalNotifs = (): AppNotification[] => {
    try {
        const stored = localStorage.getItem(MOCK_NOTIF_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

const saveLocalNotif = (notif: AppNotification) => {
    const current = getLocalNotifs();
    // Add to beginning
    localStorage.setItem(MOCK_NOTIF_KEY, JSON.stringify([notif, ...current].slice(0, 50)));
};

const markLocalRead = (ids: string[]) => {
    const current = getLocalNotifs();
    const updated = current.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n);
    localStorage.setItem(MOCK_NOTIF_KEY, JSON.stringify(updated));
};

export const notificationService = {
  /**
   * Get current configuration from Supabase, with a 1-minute cache.
   */
  async getConfig(): Promise<EmailConfig> {
    const now = Date.now();
    if (configCache && cacheTimestamp && (now - cacheTimestamp < 60000)) {
        return configCache;
    }

    if (!isSupabaseConfigured) {
      return { serviceId: '', templateId: '', publicKey: '' };
    }
    
    try {
      const { data, error } = await supabase
        .from('app_email_config')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116' && error.code !== 'PGRST205' && error.code !== '42P01') { 
          console.error("Error fetching email config:", JSON.stringify(error, null, 2));
        }
        return { serviceId: '', templateId: '', publicKey: '' };
      }

      const config = {
        serviceId: data?.service_id || '',
        templateId: data?.template_id || '',
        publicKey: data?.public_key || '',
        ccEmail: data?.cc_email || '',
      };

      configCache = config;
      cacheTimestamp = now;
      return config;

    } catch (e) {
      console.error("Failed to fetch email config", e);
      return { serviceId: '', templateId: '', publicKey: '' };
    }
  },

  /**
   * Save configuration to Supabase.
   */
  async saveConfig(config: EmailConfig): Promise<void> {
    if (!isSupabaseConfigured) {
      console.warn("Cannot save email config, Supabase not configured.");
      throw new Error("Database not connected.");
    }

    const payload = {
      id: 1, // Singleton row
      service_id: config.serviceId,
      template_id: config.templateId,
      public_key: config.publicKey,
      cc_email: config.ccEmail,
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from('app_email_config').upsert(payload);
    
    if (error) {
      console.error("Error saving email config:", error);
      throw error;
    }

    configCache = null;
    cacheTimestamp = null;
  },

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return !!(config.serviceId && config.templateId && config.publicKey);
  },

  async sendTestEmail(toEmail: string, sampleRequest?: FreightRequest): Promise<boolean> {
    const config = await this.getConfig();
    if (!config.serviceId || !config.templateId || !config.publicKey) {
      throw new Error("Email service not configured.");
    }

    let subject = 'FreightGuard Test Notification';
    let message = 'This is a test message from FreightGuard to verify your connection settings.\n\nSystem is operational.';
    let link = this._getLink(''); // Default base link

    if (sampleRequest) {
        subject = `TEST: Action Required for Log #${sampleRequest.id}`;
        // Message body contains ONLY text, no raw links. The link is passed to action_url.
        message = `Dear Administrator,\n\nThis is a SIMULATION using real data from shipment #${sampleRequest.id}.\n\nOrigin: ${sampleRequest.originCode || sampleRequest.origin}\nDestination: ${sampleRequest.destCode || sampleRequest.destination}\nCost: $${sampleRequest.price}`;
        link = this._getLink(sampleRequest.id);
    }

    const params = {
      to_name: 'System Admin',
      to_email: toEmail,
      cc_email: config.ccEmail,
      subject: subject,
      message: message,
      action_url: link, // Link injected here for the button
    };

    const res = await emailjs.send(config.serviceId, config.templateId, params, config.publicKey);
    return res.status === 200;
  },

  /**
   * Helper to send generic email to a user list AND create in-app notification.
   * Merges global CC email with optional request-specific CC emails.
   */
  async _sendToUsers(users: User[], subject: string, messageBody: string, extraCc?: string, actionLink?: string, type: 'INFO' | 'ACTION' | 'SUCCESS' | 'ERROR' = 'INFO'): Promise<void> {
    const configured = await this.isConfigured();
    const urlToUse = actionLink || this._getLink('');
    
    // In-App Notification Logic
    const notifications = users.map(u => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2,9),
        user_email: u.email,
        title: subject,
        message: messageBody,
        link: urlToUse,
        type: type,
        is_read: false,
        created_at: new Date().toISOString()
    }));

    // 1. Try DB Insert
    let dbSuccess = false;
    if (isSupabaseConfigured) {
        try {
            const { error } = await supabase.from('app_notifications').insert(
                notifications.map(({ id, ...rest }) => rest) // Let DB gen UUID or use what we matched? Better let DB gen if column is uuid default gen_random_uuid(), but we can pass it if we want consistency.
            );
            if (!error) {
                dbSuccess = true;
            } else {
                // Log actual error for debugging
                console.error("Notification DB Insert Error:", error.message || error);
            }
        } catch (e) {
            console.error("Notification DB Exception:", e);
        }
    }

    // 2. Fallback to LocalStorage if DB failed (or not configured)
    if (!dbSuccess) {
        notifications.forEach(n => saveLocalNotif(n));
    }

    // Email Sending Logic
    if (!configured) {
        console.log(`[Mock Email] '${subject}' to: ${users.map(u => u.email).join(', ')}`);
        return;
    }

    const config = await this.getConfig();
    const ccList = [config.ccEmail, extraCc].filter(Boolean).join(',');

    for (const user of users) {
      try {
        const templateParams = { 
            to_name: user.name, 
            to_email: user.email, 
            cc_email: ccList,
            subject, 
            message: messageBody, 
            action_url: urlToUse
        };
        await emailjs.send(config.serviceId, config.templateId, templateParams, config.publicKey);
        console.log(`✅ Email sent to ${user.email}`);
      } catch (error) {
        console.error(`❌ Email failed for ${user.email}`, error);
      }
    }
  },

  _getLink(requestId: string): string {
      let baseUrl = APP_BASE_URL;
      
      if (typeof window !== 'undefined') {
          const currentUrl = window.location.href;
          if (currentUrl.startsWith('http://') || currentUrl.startsWith('https://')) {
             const parts = currentUrl.split('#');
             baseUrl = parts[0];
          }
      }

      baseUrl = baseUrl.replace(/\/+$/, '');
      return requestId ? `${baseUrl}/#/shipments/${requestId}` : `${baseUrl}/#/dashboard`;
  },

  async _getRequesterEmail(request: FreightRequest): Promise<string | undefined> {
      if (request.requesterEmail) return request.requesterEmail;
      if (request.requester) {
          const allUsers = await userService.getAllUsers();
          const u = allUsers.find(u => u.name?.toUpperCase() === request.requester.toUpperCase());
          return u?.email;
      }
      return undefined;
  },

  async _mergeCc(request: FreightRequest, includeRequester: boolean): Promise<string> {
    const list = new Set<string>();
    if (request.ccEmails) {
        request.ccEmails.split(',').forEach(e => {
            const trimmed = e.trim();
            if(trimmed) list.add(trimmed);
        });
    }
    if (includeRequester) {
        const reqEmail = await this._getRequesterEmail(request);
        if (reqEmail) list.add(reqEmail);
    }
    return Array.from(list).join(',');
  },

  // --- Public Action Methods ---

  async notifyFirstApprover(request: FreightRequest): Promise<void> {
    const allUsers = await userService.getAllUsers();
    let targetUsers: User[] = [];
    
    if (request.firstApprover) {
        const user = allUsers.find(u => u.email === request.firstApprover);
        if (user) targetUsers.push(user);
    } else {
        targetUsers = allUsers.filter(u => (u.role === 'APPROVER' || u.role === 'ADMIN') && u.status === 'ACTIVE');
    }

    const link = this._getLink(request.id);
    const subject = `ACTION REQUIRED: Level 1 Approval for Log #${request.id}`;
    const salutation = targetUsers.length === 1 ? targetUsers[0].name : 'Approver';
    const message = `Dear ${salutation},\n\nFreight request #${request.id} has been submitted and requires your Level 1 approval.\n\nOrigin: ${request.originCode || request.origin}\nDestination: ${request.destCode || request.destination}\nCost: $${request.price}`;
    
    const cc = await this._mergeCc(request, true);
    await this._sendToUsers(targetUsers, subject, message, cc, link, 'ACTION');
  },

  async notifyRequesterOfL1Approval(request: FreightRequest): Promise<void> {
    const email = await this._getRequesterEmail(request);
    
    // In Mock Mode: Also notify admins for visibility
    const extraUsers: User[] = [];
    if (!isSupabaseConfigured) {
        const allUsers = await userService.getAllUsers();
        extraUsers.push(...allUsers.filter(u => u.role === 'ADMIN'));
    }

    let targetUsers: User[] = extraUsers;
    if (email) {
        targetUsers.push({ name: request.requester, email: email } as User);
    }

    // Deduplicate
    targetUsers = Array.from(new Map(targetUsers.map(u => [u.email, u])).values());

    const link = this._getLink(request.id);
    const subject = `PROGRESS: Level 1 Approved for Log #${request.id}`;
    const message = `Your freight request #${request.id} has been approved by Level 1 (${request.l1ApprovedBy || 'Approver'}).\n\nIt is now pending Level 2 approval.\n\nRemark: ${request.l1ApprovalRemark || 'None'}`;
    
    const cc = await this._mergeCc(request, false);
    await this._sendToUsers(targetUsers, subject, message, cc, link, 'INFO');
  },

  async notifySecondApprover(request: FreightRequest): Promise<void> {
    if (!request.secondApprover) return;

    const allUsers = await userService.getAllUsers();
    const user = allUsers.find(u => u.email === request.secondApprover);
    if (!user) return;

    const link = this._getLink(request.id);
    const subject = `ACTION REQUIRED: Level 2 Approval for Log #${request.id}`;
    const message = `Dear ${user.name},\n\nFreight request #${request.id} has passed Level 1 approval and now requires your final approval.\n\nOrigin: ${request.originCode || request.origin}\nDestination: ${request.destCode || request.destination}\nCost: $${request.price}`;
    
    const cc = await this._mergeCc(request, true);
    await this._sendToUsers([user], subject, message, cc, link, 'ACTION');
  },

  async notifyRequesterOfApproval(request: FreightRequest): Promise<void> {
    const email = await this._getRequesterEmail(request);
    
    // In Mock Mode: Also notify admins for visibility
    const extraUsers: User[] = [];
    if (!isSupabaseConfigured) {
        const allUsers = await userService.getAllUsers();
        extraUsers.push(...allUsers.filter(u => u.role === 'ADMIN'));
    }

    let targetUsers: User[] = extraUsers;
    if (email) {
        targetUsers.push({ name: request.requester, email: email } as User);
    }
    targetUsers = Array.from(new Map(targetUsers.map(u => [u.email, u])).values());

    const link = this._getLink(request.id);
    const subject = `APPROVED: Your Shipment Log #${request.id}`;
    const message = `Good news! Your freight request #${request.id} has been FULLY APPROVED.\n\nFinal Approver: ${request.approvedBy}\nRemark: ${request.approvalRemark || 'None'}`;
    
    const cc = await this._mergeCc(request, false);
    await this._sendToUsers(targetUsers, subject, message, cc, link, 'SUCCESS');
  },

  async notifyFirstApproverOfCompletion(request: FreightRequest): Promise<void> {
    if (!request.firstApprover) return;
    
    const allUsers = await userService.getAllUsers();
    const user = allUsers.find(u => u.email === request.firstApprover);
    if (!user) return;

    const link = this._getLink(request.id);
    const subject = `COMPLETED: Shipment #${request.id} Approved by Level 2`;
    const message = `Dear ${user.name},\n\nThe freight request #${request.id} you approved at Level 1 has now been FULLY APPROVED by Level 2 (${request.approvedBy}).\n\nThe workflow is complete.`;

    const cc = await this._mergeCc(request, true);
    await this._sendToUsers([user], subject, message, cc, link, 'INFO');
  },

  async notifyRequesterOfRejection(request: FreightRequest): Promise<void> {
    const email = await this._getRequesterEmail(request);
    
    // In Mock Mode: Also notify admins for visibility
    const extraUsers: User[] = [];
    if (!isSupabaseConfigured) {
        const allUsers = await userService.getAllUsers();
        extraUsers.push(...allUsers.filter(u => u.role === 'ADMIN'));
    }

    let targetUsers: User[] = extraUsers;
    if (email) {
        targetUsers.push({ name: request.requester, email: email } as User);
    }
    targetUsers = Array.from(new Map(targetUsers.map(u => [u.email, u])).values());

    const link = this._getLink(request.id);
    const subject = `REJECTED: Your Shipment Log #${request.id}`;
    const message = `Your freight request #${request.id} has been REJECTED by ${request.rejectedBy}.\n\nReason: ${request.rejectionReason}`;
    
    const cc = await this._mergeCc(request, false);
    await this._sendToUsers(targetUsers, subject, message, cc, link, 'ERROR');
  },

  async notifyRequesterOfCancellation(request: FreightRequest): Promise<void> {
    const email = await this._getRequesterEmail(request);
    if (!email) return;

    const link = this._getLink(request.id);
    const subject = `CANCELLED: Your Shipment Log #${request.id}`;
    const message = `Your freight request #${request.id} has been CANCELLED by ${request.cancelledBy}.\n\nReason: ${request.cancellationReason}`;
    
    const userObj = { name: request.requester, email: email } as User;
    const cc = await this._mergeCc(request, false);
    await this._sendToUsers([userObj], subject, message, cc, link, 'INFO');
  },

  async sendReminder(request: FreightRequest, senderName: string, customNote?: string): Promise<void> {
    let targetEmail: string | undefined;
    let stage = '';

    if (request.status === RequestStatus.PENDING) {
        targetEmail = request.firstApprover;
        stage = 'Level 1';
    } else if (request.status === RequestStatus.PENDING_L2) {
        targetEmail = request.secondApprover;
        stage = 'Level 2';
    } else {
        throw new Error("Cannot send reminder: Request is not pending approval.");
    }

    if (!targetEmail) {
        throw new Error("No approver email assigned for this stage.");
    }

    const allUsers = await userService.getAllUsers();
    const user = allUsers.find(u => u.email === targetEmail);
    const approverName = user ? user.name : targetEmail;

    const link = this._getLink(request.id);
    const subject = `REMINDER: Approval Required for Log #${request.id}`;
    
    let message = `Dear ${approverName},\n\nThis is a gentle reminder regarding the pending ${stage} approval for Shipment #${request.id}.\n\nRoute: ${request.originCode || request.origin} -> ${request.destCode || request.destination}\nRequested By: ${request.requester}\n\nPlease review at your earliest convenience.`;

    if (customNote) {
        message += `\n\nNote from ${senderName}: "${customNote}"`;
    }

    const cc = await this._mergeCc(request, true);
    await this._sendToUsers([{ name: approverName, email: targetEmail } as User], subject, message, cc, link, 'ACTION');
  },

  async getMyNotifications(email: string): Promise<AppNotification[]> {
      let dbNotifs: AppNotification[] = [];
      let mockNotifs: AppNotification[] = [];

      // 1. Try DB
      if (isSupabaseConfigured) {
          try {
              const { data, error } = await supabase
                  .from('app_notifications')
                  .select('*')
                  .eq('user_email', email)
                  .order('created_at', { ascending: false })
                  .limit(20);
              
              if (!error && data) {
                  dbNotifs = data as AppNotification[];
              } else if (error) {
                  // Only log error if NOT a network failure to avoid spam
                  if (!error.message.includes('Failed to fetch')) {
                      console.error("Fetch Notifications Error:", error.message || error);
                  }
              }
          } catch (e: any) {
              // Silently fail on network/fetch errors during polling
              if (e.message && e.message.includes('Failed to fetch')) {
                  // Optional: console.warn("Notification poll skipped (offline)");
              } else {
                  console.error("Fetch Notifications Exception:", e);
              }
          }
      }

      // 2. Get Local
      const allLocal = getLocalNotifs();
      mockNotifs = allLocal.filter(n => n.user_email === email);

      // 3. Merge (Mock usually has IDs generated by random string, DB by UUID)
      // Prefer DB if duplicate ID (unlikely due to generation method)
      const combined = [...dbNotifs, ...mockNotifs];
      
      // Deduplicate by ID
      const seen = new Set();
      const unique = combined.filter(n => {
          const duplicate = seen.has(n.id);
          seen.add(n.id);
          return !duplicate;
      });

      return unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
  },

  async markAsRead(ids: string[]): Promise<void> {
      // 1. Try DB
      if (isSupabaseConfigured && ids.length > 0) {
          try {
              await supabase.from('app_notifications').update({ is_read: true }).in('id', ids);
          } catch(e) {
              console.error("Mark Read Error:", e);
          }
      }
      // 2. Always update local
      markLocalRead(ids);
  }
};
