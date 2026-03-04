
import { supabase, isSupabaseConfigured } from './supabaseClient';

const BUCKET_NAME = 'freight-files';

const sanitizeFileName = (name: string) => {
  // Replace non-alphanumeric characters (except dots and hyphens) with underscores
  // This prevents issues with Supabase Storage paths and URL encoding
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
};

export const fileService = {
  /**
   * Lists files for a specific shipment.
   * Path structure: shipment_files/{requestId}/filename.ext
   */
  async listFiles(requestId: string) {
    if (!isSupabaseConfigured) {
        // In mock mode, we can't really list files. Return empty.
        return [];
    }
    if (!requestId) return [];
    
    try {
        // We use a dedicated prefix 'shipments' to avoid root-level conflicts
        const folderPath = `shipments/${requestId}`;
        
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .list(folderPath, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (error) {
          // If the error is 'not found' or bucket missing, handle gracefully
          if (error.message?.includes('not found') || (error as any).status === 404) {
            return [];
          }
          console.error('Error listing files:', error);
          return [];
        }

        // Supabase list() returns metadata objects. 
        // We filter out any directory placeholders (.emptyFolderPlaceholder) 
        // that Supabase sometimes creates.
        return (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
    } catch (e) {
        console.warn("Storage list failed:", e);
        return [];
    }
  },

  async uploadFile(requestId: string, file: File) {
    if (!isSupabaseConfigured) {
        console.warn("[Mock Mode] File upload skipped (no database connection):", file.name);
        return null; 
    }
    if (!requestId) throw new Error("Shipment ID is required for upload");

    const sanitizedName = sanitizeFileName(file.name);
    // Strictly enforce subfolder per shipment ID
    const filePath = `shipments/${requestId}/${sanitizedName}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
          upsert: true,
          contentType: file.type
      });

    if (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      throw error;
    }
    
    return this.getPublicUrl(requestId, sanitizedName);
  },

  async deleteFile(requestId: string, fileName: string) {
    if (!isSupabaseConfigured) return;

    // fileName comes from listFiles, so it's already sanitized/as stored
    const filePath = `shipments/${requestId}/${fileName}`;
    console.log("[FileService] Deleting file at path:", filePath);
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  /**
   * Deletes all files associated with a specific shipment ID.
   * Used when deleting the shipment record itself.
   */
  async deleteShipmentFolder(requestId: string) {
    if (!isSupabaseConfigured || !requestId) return;

    try {
      // 1. List all files in the folder
      const files = await this.listFiles(requestId);
      if (!files || files.length === 0) return;

      // 2. Construct paths for removal
      const paths = files.map((f: any) => `shipments/${requestId}/${f.name}`);
      
      // 3. Batch remove
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(paths);

      if (error) {
        console.error('Error cleaning up shipment files:', error);
      } else {
        console.log(`[FileService] Cleaned up ${paths.length} files for deleted request ${requestId}`);
      }
    } catch (e) {
      console.warn("Storage cleanup failed (non-critical):", e);
    }
  },

  getPublicUrl(requestId: string, fileName: string) {
    if (!isSupabaseConfigured || !requestId || !fileName) return null;
    const filePath = `shipments/${requestId}/${fileName}`;
    
    // Note: getPublicUrl returns a URL regardless of file existence.
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
      
    return data.publicUrl;
  }
};
