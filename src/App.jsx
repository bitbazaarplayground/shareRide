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
import AdminDashboard from "./Pages/AdminDashboard";
import AllPostedRides from "./Pages/AllPostedRides";
import AuthCallback from "./Pages/AuthCallback";
import CompleteProfile from "./Pages/CompleteProfile";
import Homepage from "./Pages/Homepage";
import IndividualRide from "./Pages/IndividualRide";
import Login from "./Pages/Login";
import OurMission from "./Pages/OurMission";
import Results from "./Pages/Results";
import SignUp from "./Pages/SignUp";
import TermsofUse from "./Pages/TermsOfUse";
import UserProfile from "./Pages/UserProfile";
import "./i18n";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="full-width-nav">
          <Navbar />
        </div>

        <div className="app-content">
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <SearchBar />
                  <Homepage />
                </>
              }
            />
            <Route
              path="/publishride"
              element={
                <>
                  <PublishRide />
                </>
              }
            />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/ourmission" element={<OurMission />} />
            <Route path="/register" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/results" element={<Results />} />
            <Route path="*" element={<Navigate to="/" />} />
            <Route path="/all-rides" element={<AllPostedRides />} />
            <Route path="/individual-ride/:id" element={<IndividualRide />} />
            <Route path="/Termsofuse" element={<TermsofUse />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}
