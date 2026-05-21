import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Setup Drive OAuth scopes
const driveProvider = new GoogleAuthProvider();
driveProvider.addScope('https://www.googleapis.com/auth/drive');

// In-memory token storage (Do NOT persist to localStorage/sessionStorage as per privacy skill)
let cachedDriveToken: string | null = null;

export function getCachedDriveToken(): string | null {
  return cachedDriveToken;
}

export function setCachedDriveToken(token: string | null) {
  cachedDriveToken = token;
}

/**
 * Handle Google authentication with Google Drive scopes via popup
 */
export async function connectGoogleDrive(): Promise<string> {
  try {
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('Não foi possível obter o Token de Acesso do Google Drive.');
    }

    cachedDriveToken = token;
    return token;
  } catch (error) {
    console.error('Erro de conexão ao Google Drive:', error);
    throw error;
  }
}

/**
 * Disconnect Google Drive (clear cache)
 */
export function disconnectGoogleDrive() {
  cachedDriveToken = null;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  webViewLink?: string;
}

/**
 * List files matching "GrajaFood" in the user's Google Drive
 */
export async function listGrajaFoodDriveFiles(accessToken: string): Promise<DriveFile[]> {
  const query = "name contains 'GrajaFood'";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime,webViewLink)&orderBy=createdTime%20desc`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Falha ao listar backups no Google Drive.');
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Upload backup files to Google Drive using the multipart/related upload method
 */
export async function uploadBackupToDrive(
  accessToken: string,
  filename: string,
  content: string,
  mimeType: string = 'text/markdown'
): Promise<DriveFile> {
  const metadata = {
    name: filename,
    mimeType: mimeType,
  };

  const boundary = 'graja_food_multipart_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelim;

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime,webViewLink';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Falha ao enviar backup para o Google Drive.');
  }

  return await res.json();
}

/**
 * Delete a backup file from Google Drive
 * Requires explicit confirmation in the UI before calling this method
 */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Falha ao excluir o arquivo do Google Drive.');
  }
}
