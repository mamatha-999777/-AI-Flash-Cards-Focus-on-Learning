import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { StudyContent } from "./lib/gemini";

import Welcome from "./components/Welcome";
import Dashboard from "./components/Dashboard";
import CaptureView from "./components/CaptureView";
import StudySession from "./components/StudySession";
import FocusMode from "./components/FocusMode";

type AppState = "auth" | "dashboard" | "capture" | "study" | "focus" | "shared";

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: any;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<AppState>("auth");
  const [history, setHistory] = useState<(StudyContent & { id: string; createdAt: any; folderId?: string; isPublic?: boolean; imageUrl?: string })[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeGuide, setActiveGuide] = useState<(StudyContent & { id: string; isPublic?: boolean; imageUrl?: string }) | null>(null);

  useEffect(() => {
    // Handle Public Sharing links ?share=userId.guideId
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    if (shareId && shareId.includes(".")) {
      const [userId, guideId] = shareId.split(".");
      loadPublicGuide(userId, guideId);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      // Only transition to dashboard if we aren't in a public share view
      if (user && !params.get("share")) {
        setState("dashboard");
        // Ensure user profile exists
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              createdAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.error("Error profile sync:", error);
        }
      } else if (!user && !params.get("share")) {
        setState("auth");
      }
    });

    return () => unsubscribe();
  }, []);

  const loadPublicGuide = async (userId: string, guideId: string) => {
    try {
      const guideRef = doc(db, `users/${userId}/studyGuides`, guideId);
      const snap = await getDoc(guideRef);
      if (snap.exists() && snap.data().isPublic) {
        setActiveGuide({ id: snap.id, ...snap.data() } as any);
        setState("shared");
      } else {
        console.warn("Public guide not found or private");
      }
    } catch (e) {
      console.error("Error loading shared guide:", e);
    }
  };

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setFolders([]);
      return;
    }

    // Listen to Guides
    const qGuides = query(
      collection(db, `users/${user.uid}/studyGuides`),
      orderBy("createdAt", "desc")
    );

    const unsubGuides = onSnapshot(qGuides, (snapshot) => {
      const guides = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setHistory(guides);
    });

    // Listen to Folders
    const qFolders = query(
      collection(db, `users/${user.uid}/folders`),
      orderBy("createdAt", "desc")
    );

    const unsubFolders = onSnapshot(qFolders, (snapshot) => {
      const folderList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Folder[];
      setFolders(folderList);
    });

    return () => {
      unsubGuides();
      unsubFolders();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-12 h-12 border-4 border-brand-coral border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {state === "auth" && <Welcome />}
      
      {state === "dashboard" && (
        <Dashboard 
          history={history}
          folders={folders}
          onStartCapture={() => setState("capture")}
          onStartFocus={() => setState("focus")}
          onSelectGuide={(guide) => {
            setActiveGuide(guide as any);
            setState("study");
          }}
        />
      )}

      {state === "capture" && (
        <CaptureView 
          onCancel={() => setState("dashboard")}
          onSuccess={(guide) => {
            setActiveGuide(guide as any);
            setState("study");
          }}
        />
      )}

      {state === "focus" && (
        <FocusMode 
          onBack={() => setState("dashboard")}
          onStartCapture={() => setState("capture")}
        />
      )}

      {(state === "study" || state === "shared") && activeGuide && (
        <StudySession 
          guide={activeGuide}
          isPublicView={state === "shared"}
          onBack={() => {
            if (state === "shared") {
              window.history.pushState({}, '', '/');
              setState(user ? "dashboard" : "auth");
            } else {
              setState("dashboard");
            }
          }}
        />
      )}
    </div>
  );
}

