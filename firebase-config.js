// Initialize Firebase globally for compatibility
const firebaseConfig = {
  apiKey: "AIzaSyBJ1XvASsCXL78rMJAs25K6oKCr393ixbM",
  authDomain: "awesome--interiors.firebaseapp.com",
  projectId: "awesome--interiors",
  storageBucket: "awesome--interiors.firebasestorage.app",
  messagingSenderId: "113132383610",
  appId: "1:113132383610:web:bbe63676b415f7a4f7bac3"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
