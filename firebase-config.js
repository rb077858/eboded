// ---------------------------------------------------------------------------
// Firebase project configuration.
//
// 1. Go to https://console.firebase.google.com and create a project (free
//    "Spark" plan is enough).
// 2. In the project, click the "</>" (web app) icon to register a web app.
// 3. Firebase shows you a config object exactly like the one below —
//    copy YOUR values into it here.
// 4. In the Firebase console, enable:
//      Build > Authentication > Sign-in method > Email/Password  (enable)
//      Build > Authentication > Sign-in method > Google           (enable)
//      Build > Firestore Database > Create database (production mode)
// 5. Deploy the security rules in firestore.rules (see README.md).
// ---------------------------------------------------------------------------

var firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// The one person who is always allowed to be admin (bootstrap account).
// Sign in once with this email (password sign-up, or Google) and the app
// will automatically make it an admin. Afterwards, the admin panel inside
// the app lets this account hand admin/manager rights to anyone else.
var ADMIN_EMAIL = "rb077858@gmail.com";
