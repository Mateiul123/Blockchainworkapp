import { PinataSDK } from "pinata";

let pinata = null;
let isInitialized = false;

/**
 * Initialize Pinata client with JWT token
 * Get your JWT from: https://app.pinata.cloud/developers/api-keys
 */
export async function initIPFS() {
  if (isInitialized && pinata) return pinata;
  
  try {
    // Check for Pinata JWT in environment variable or localStorage
    const jwt = import.meta.env.VITE_PINATA_JWT || localStorage.getItem('pinata_jwt');
    
    if (!jwt) {
      console.warn("⚠️ No Pinata JWT found. Set VITE_PINATA_JWT in .env or call setPinataJWT()");
      isInitialized = true;
      return null;
    }
    
    pinata = new PinataSDK({
      pinataJwt: jwt,
    });
    
    // ✅ Debug: Log available methods
    console.log("Pinata SDK methods:", Object.keys(pinata));
    if (pinata.upload) {
      const uploadMethods = Object.keys(pinata.upload);
      console.log("Pinata upload methods:", uploadMethods);
      
      // Log each method name individually
      uploadMethods.forEach(method => {
        console.log(`  - upload.${method} is a`, typeof pinata.upload[method]);
      });
    }
    
    // Test the connection
    try {
      await pinata.testAuthentication();
      console.log("✅ Pinata connected successfully");
    } catch (testErr) {
      console.warn("Pinata auth test failed:", testErr);
    }
    
    isInitialized = true;
    return pinata;
  } catch (e) {
    console.warn("Pinata init failed:", e);
    isInitialized = true;
    return null;
  }
}

/**
 * Set Pinata JWT (useful for runtime configuration)
 * @param {string} jwt - Your Pinata JWT token
 */
export function setPinataJWT(jwt) {
  if (jwt) {
    localStorage.setItem('pinata_jwt', jwt);
    isInitialized = false; // Force re-init
    pinata = null;
  }
}

/**
 * Upload task metadata to IPFS via Pinata
 * @param {Object} metadata - Task metadata { description, tags, attachments, etc }
 * @returns {Promise<string>} - IPFS CID
 */
export async function uploadTaskMetadata(metadata) {
  try {
    if (!pinata) await initIPFS();
    
    if (!pinata) {
      return uploadMetadataFallback(metadata);
    }
    
    const json = JSON.stringify(metadata, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], 'metadata.json', { type: 'application/json' });
    
    // ✅ Fixed: Use correct Pinata SDK v2 API - pinata.upload.public.file()
    const upload = await pinata.upload.public.file(file);
    console.log("✅ Metadata uploaded to Pinata:", upload.cid);
    return upload.cid;
  } catch (e) {
    console.error("Pinata upload failed, using fallback:", e);
    return uploadMetadataFallback(metadata);
  }
}

/**
 * Upload file(s) to IPFS via Pinata
 * @param {File|File[]} files - File or array of files to upload
 * @returns {Promise<string>} - IPFS CID
 */
export async function uploadFiles(files) {
  try {
    if (!pinata) await initIPFS();
    
    if (!pinata) {
      return uploadFilesFallback(files);
    }
    
    const fileArray = Array.isArray(files) ? files : [files];
    
    if (fileArray.length === 1) {
      // ✅ Fixed: Use correct Pinata SDK v2 API - pinata.upload.public.file()
      const upload = await pinata.upload.public.file(fileArray[0]);
      console.log("✅ File uploaded to Pinata:", upload.cid);
      return upload.cid;
    } else {
      // Upload multiple files
      const uploads = await Promise.all(
        fileArray.map(file => pinata.upload.public.file(file))
      );
      console.log(`✅ ${uploads.length} files uploaded to Pinata`);
      
      // Return array of CIDs as JSON
      const cids = uploads.map(u => u.cid);
      return await uploadTaskMetadata({ files: cids });
    }
  } catch (e) {
    console.error("Pinata file upload failed, using fallback:", e);
    return uploadFilesFallback(files);
  }
}

/**
 * Fetch content from IPFS using Pinata gateway or public gateway
 * @param {string} cid - IPFS CID
 * @returns {Promise<Object>} - Parsed content
 */
export async function fetchFromIPFS(cid) {
  if (!cid) return null;

  try {
    // First try localStorage (for demo/fallback data)
    const localData = localStorage.getItem(`ipfs_metadata_${cid}`);
    if (localData) {
      return JSON.parse(localData);
    }
    
    // Try Pinata gateway (faster, more reliable)
    const pinataGateway = `https://gateway.pinata.cloud/ipfs/${cid}`;
    const publicGateway = `https://ipfs.io/ipfs/${cid}`;
    
    let response;
    try {
      response = await fetch(pinataGateway);
    } catch {
      response = await fetch(publicGateway);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (e) {
    console.warn(`Failed to fetch IPFS content (${cid}):`, e);
    return null;
  }
}

/**
 * Get IPFS gateway URL for a CID
 * @param {string} cid - IPFS CID
 * @returns {string} - Gateway URL
 */
export function getIPFSUrl(cid) {
  if (!cid) return '';
  
  // Check if it's a demo CID stored in localStorage
  const localData = localStorage.getItem(`ipfs_files_${cid}`);
  if (localData) {
    try {
      const files = JSON.parse(localData);
      if (files && files[0]?.dataUrl) {
        return files[0].dataUrl;
      }
    } catch (e) {
      console.warn("Failed to parse local file data:", e);
    }
  }
  
  // Use Pinata gateway for better performance
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

/**
 * Check if a string is a valid IPFS CID
 * @param {string} str - String to check
 * @returns {boolean}
 */
export function isIPFSCID(str) {
  if (!str || typeof str !== 'string') return false;
  
  // CIDv0 starts with Qm, CIDv1 starts with b or z, also accept our mock CIDs
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58}|z[1-9A-HJ-NP-Za-km-z]{48}|bafybei\w+)/.test(str);
}

// ========== FALLBACK FUNCTIONS (for demo without Pinata) ==========

function uploadMetadataFallback(metadata) {
  const json = JSON.stringify(metadata, null, 2);
  const mockCID = 'bafybeihash' + Math.random().toString(36).substring(2, 15);
  
  console.log("📦 Using localStorage fallback for metadata");
  
  try {
    localStorage.setItem(`ipfs_metadata_${mockCID}`, json);
  } catch (storageErr) {
    console.warn("LocalStorage failed:", storageErr);
  }
  
  return mockCID;
}

async function uploadFilesFallback(files) {
  const fileArray = Array.isArray(files) ? files : [files];
  const mockCID = 'bafybeifile' + Math.random().toString(36).substring(2, 15);
  
  console.log(`📦 Using localStorage fallback for ${fileArray.length} file(s)`);
  
  const fileMetadata = await Promise.all(
    fileArray.map(async (file) => {
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
      };
    })
  );
  
  try {
    localStorage.setItem(`ipfs_files_${mockCID}`, JSON.stringify(fileMetadata));
  } catch (storageErr) {
    console.warn("LocalStorage failed:", storageErr);
  }
  
  return mockCID;
}

export default {
  initIPFS,
  setPinataJWT,
  uploadTaskMetadata,
  uploadFiles,
  fetchFromIPFS,
  getIPFSUrl,
  isIPFSCID,
};
