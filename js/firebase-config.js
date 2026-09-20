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
  apiKey: "AIzaSyAwdnTmCbOyY7v1PdTlngC0k-MaGW0URMI",
  authDomain: "eboded-e382a.firebaseapp.com",
  projectId: "eboded-e382a",
  storageBucket: "eboded-e382a.firebasestorage.app",
  messagingSenderId: "848482864269",
  appId: "1:848482864269:web:a444ae89af4905e707a6c4"
};

// The one person who is always allowed to be admin (bootstrap account).
// Sign in once with this email (password sign-up, or Google) and the app
// will automatically make it an admin. Afterwards, the admin panel inside
// the app lets this account hand admin/manager rights to anyone else.
var ADMIN_EMAIL = "rb077858@gmail.com";
