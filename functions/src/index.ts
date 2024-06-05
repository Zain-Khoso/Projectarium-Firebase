// Admin Imports.
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Functions Imports.
import { region } from "firebase-functions/v1";
import {
  onDocumentCreatedWithAuthContext,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";

// Confifurations.
admin.initializeApp();
const firestore = getFirestore();
const storage = getStorage().bucket();

//        AUTH FUNCTIONS.

/*
  This function is triggered everytime a new user is created.
  It stores the new user's data inside of users collection in firestore.
*/
export const onUserCreate = region("asia-south1")
  .auth.user()
  .onCreate(function (user) {
    const {
      uid,
      email,
      photoURL,
      displayName,
      metadata: { creationTime },
    } = user;

    return firestore.collection("users").doc(uid).set({
      email,
      picture: photoURL,
      name: displayName,
      createdAt: creationTime,
      status: "active",
    });
  });

/*
  This function is triggered everytime a user is deleted.
  It deetes the user's data from inside of users collection in firestore.
*/
export const onUserDelete = region("asia-south1")
  .auth.user()
  .onDelete(function (user) {
    return firestore.collection("users").doc(user.uid).delete();
  });

//        FIRESTORE FUNCTIONS.

/*
  This function is triggered everytime a new project is created.
  It stores the creator, createdAt & lifecycleStatus inside of project document in firestore.
*/
export const onProjectCreate = onDocumentCreatedWithAuthContext(
  {
    document: "projects/{docId}",
    region: "asia-south1",
  },
  async function (event) {
    const { data, authId: uid } = event;

    const response = await firestore.doc(`users/${uid}`).get();
    const user = response.data();

    return data?.ref.set(
      {
        creator: {
          uid,
          name: user?.name,
          picture: user?.picture,
        },
        createdAt: data.createTime,
        lifecycleStatus: "Published",
      },
      { merge: true }
    );
  }
);

/*
  This function is triggered everytime a project is deleted.
  It deletes all subcollections & images related to this project.
*/
export const onProjectDelete = onDocumentDeleted(
  {
    document: "projects/{docId}",
    region: "asia-south1",
  },
  async function (event) {
    const project = event.data?.data();
    const pattern =
      /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^\/]+\/o\/([^?]+)/;

    const deleteProps = project?.images?.map((url: string) => {
      const match = url.match(pattern);
      storage.file(match ? decodeURIComponent(match[1]) : url).delete();
    });

    return Promise.all(deleteProps);
  }
);
