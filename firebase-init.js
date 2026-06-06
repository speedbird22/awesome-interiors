import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJ1XvASsCXL78rMJAs25K6oKCr393ixbM",
  authDomain: "awesome--interiors.firebaseapp.com",
  projectId: "awesome--interiors",
  storageBucket: "awesome--interiors.firebasestorage.app",
  messagingSenderId: "113132383610",
  appId: "1:113132383610:web:bbe63676b415f7a4f7bac3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
