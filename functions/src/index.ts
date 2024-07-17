// Admin Imports.
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Functions Imports.
import { region } from "firebase-functions/v1";
import {
  onDocumentCreatedWithAuthContext,
  onDocumentCreated,
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

/*
  This function is triggered everytime a new project contributor is created.
  It stores the contributor's data & contribution status inside of project contribution document.
  And also creates a new notification document inside the contributor's notification subcollection.
*/
export const onProjectContributorCreate = onDocumentCreated(
  {
    document: "projects/{projectId}/contributors/{userId}",
    region: "asia-south1",
  },
  async function (event) {
    const {
      params: { projectId, userId },
      data,
    } = event;

    // Requesting user data.
    const userSnapshot = await firestore.doc(`users/${userId}`).get();
    const user = userSnapshot.data();

    // Requesting project data.
    const projectSnapshot = await firestore.doc(`projects/${projectId}`).get();
    const project = projectSnapshot.data();

    // Creating contribution document in user's contributions subcollection.
    await firestore.doc(`users/${userId}/contributions/${projectId}`).set({
      projectName: project?.title,
      creatorName: project?.creator?.name,
      status: "Initialized",
      description: data?.data().description,
    });

    // Creating notification document in user's notifications subcollection.
    await firestore.collection(`users/${userId}/notifications`).add({
      title: "Contribution Request.",
      url: "users/requests",
      status: "unread",
    });

    return data?.ref.set({
      email: user?.email,
      name: user?.name,
      picture: user?.picture,
      createdAt: data.createTime,
      status: "Initialized",
      description: data.data().description,
    });
  }
);

/*
  This function is triggered everytime a contribution is delete from a project.
  It deletes the contribution data from the user's ( contributor's ) document as well.
  And also creates a new notification document inside the contributor's notification subcollection.
*/
export const onProjectContributorDelete = onDocumentDeleted(
  {
    document: "projects/{projectId}/contributors/{userId}",
    region: "asia-south1",
  },
  async function (event) {
    const {
      params: { projectId, userId },
    } = event;

    // Deleting the contribution document from user's contributions subcollection.
    const prom1 = await firestore
      .doc(`users/${userId}/contributions/${projectId}`)
      .delete();

    // Creating notification document in user's notifications subcollection.
    const prom2 = await firestore
      .collection(`users/${userId}/notifications`)
      .add({
        title: "Contribution Deleted.",
        url: null,
        status: "unread",
      });

    return Promise.all([prom1, prom2]);
  }
);
