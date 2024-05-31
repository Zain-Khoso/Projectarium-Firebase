// Admin Imports.
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Functions Imports.
import { region } from "firebase-functions/v1";

// Confifurations.
admin.initializeApp();
const firestore = getFirestore();

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
      creationTime,
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
