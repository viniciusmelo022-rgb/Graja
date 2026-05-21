import { initializeApp as adminInitializeApp, getApps as getAdminApps } from "firebase-admin/app";
import { getFirestore as adminGetFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize the Admin App securely using the configured Project ID
const apps = getAdminApps();
const adminApp = apps.length === 0 
  ? adminInitializeApp({ projectId: firebaseConfig.projectId }) 
  : apps[0];

const adminDb = adminGetFirestore(adminApp);

export function getFirestore(app?: any, databaseId?: string) {
  return adminDb;
}

export function collection(db: any, ...paths: string[]) {
  const fullPath = paths.join("/");
  return adminDb.collection(fullPath);
}

export function doc(db: any, ...paths: string[]) {
  const fullPath = paths.join("/");
  return adminDb.doc(fullPath);
}

export async function getDoc(docRef: any) {
  const snap = await docRef.get();
  return {
    exists: () => snap.exists,
    data: () => snap.data(),
    id: snap.id
  };
}

export async function getDocs(queryRef: any) {
  const snap = await queryRef.get();
  const docs = snap.docs.map((d: any) => ({
    exists: () => d.exists,
    data: () => d.data(),
    id: d.id
  }));
  return {
    empty: snap.empty,
    size: snap.size,
    docs
  };
}

export async function setDoc(docRef: any, data: any) {
  return docRef.set(data);
}

export async function updateDoc(docRef: any, data: any) {
  return docRef.update(data);
}

export async function deleteDoc(docRef: any) {
  return docRef.delete();
}

export function query(colRef: any, ...constraints: any[]) {
  let q = colRef;
  for (const c of constraints) {
    q = c(q);
  }
  return q;
}

export function where(field: string, op: any, value: any) {
  return (q: any) => q.where(field, op, value);
}

export function orderBy(field: string, direction?: "asc" | "desc") {
  return (q: any) => q.orderBy(field, direction || "asc");
}

export function limit(n: number) {
  return (q: any) => q.limit(n);
}
