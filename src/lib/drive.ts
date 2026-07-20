// Helper utilities for interacting with Google Drive API v3

export interface DriveFolderStructure {
  rootId: string;
  tpId: string;
  atpId: string;
  protaId: string;
  prosemId: string;
  rppId: string;
}

// Find a folder by name and parent
export const findFolder = async (
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string | null> => {
  try {
    let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += ` and 'root' in parents`;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gagal mencari folder di Drive:", errText);
      return null;
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error("Kesalahan findFolder:", error);
    return null;
  }
};

// Create a new folder
export const createFolder = async (
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> => {
  try {
    const body: any = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentId) {
      body.parents = [parentId];
    }

    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gagal membuat folder: ${errText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error("Kesalahan createFolder:", error);
    throw error;
  }
};

// Set up full SIPENA KAKA folder hierarchy on Google Drive
export const setupDriveStructure = async (
  accessToken: string
): Promise<DriveFolderStructure> => {
  // 1. Check or create root folder "SIPENA KAKA"
  let rootId = await findFolder(accessToken, "SIPENA KAKA");
  if (!rootId) {
    rootId = await createFolder(accessToken, "SIPENA KAKA");
  }

  // 2. Setup subfolders
  const subfolders = [
    { name: "Tujuan Pembelajaran", key: "tp" },
    { name: "ATP", key: "atp" },
    { name: "PROTA", key: "prota" },
    { name: "PROSEM", key: "prosem" },
    { name: "RPP Mendalam", key: "rpp" },
  ];

  const results: any = { rootId };

  for (const sub of subfolders) {
    let subId = await findFolder(accessToken, sub.name, rootId);
    if (!subId) {
      subId = await createFolder(accessToken, sub.name, rootId);
    }
    results[`${sub.key}Id`] = subId;
  }

  return results as DriveFolderStructure;
};

// Upload a file Blob to Google Drive in the target folder
export const uploadFileToDrive = async (
  accessToken: string,
  fileBlob: Blob,
  filename: string,
  parentId: string
): Promise<string> => {
  try {
    // We use a multipart upload to send both file metadata and file body in one request
    const metadata = {
      name: filename,
      parents: [parentId],
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    formData.append("file", fileBlob);

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gagal mengunggah file ke Google Drive: ${errText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error("Kesalahan uploadFileToDrive:", error);
    throw error;
  }
};
