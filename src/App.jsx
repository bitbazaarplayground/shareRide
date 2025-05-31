import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from "react-router-dom";
import "./App.css";
import Navbar from "./Components/Navbar";
import PublishRide from "./Components/PublishRide";
import SearchBar from "./Components/SearchBar";
import "./Components/Styles/Navbar.css";
import { AuthProvider } from "./Contexts/AuthContext";
import AuthCallback from "./Pages/AuthCallback";
import Homepage from "./Pages/Homepage";
import Login from "./Pages/Login";
import Results from "./Pages/Results";
import UserProfile, { default as SignUp } from "./Pages/UserProfile";

import "./i18n";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="full-width-nav">
          <Navbar />
        </div>

        <div className="app-content">
          <SearchBar />
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/register" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<Navigate to="/" />} />
            <Route path="/results" element={<Results />} />
            <Route path="/publish" element={<PublishRide />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}
