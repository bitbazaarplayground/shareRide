import React, { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";
import Navbar from "./Components/Navbar";
import PublishRide from "./Components/PublishRide";
import "./Components/Styles/Navbar.css";
import { AuthProvider } from "./Contexts/AuthContext";
import MessagesPage from "./Messages/MessagesPage";
import AdminDashboard from "./Pages/AdminDashboard";
import AllPostedRides from "./Pages/AllPostedRides";
import AuthCallback from "./Pages/AuthCallback";
import CompleteProfile from "./Pages/CompleteProfile";
import CookiesPolicy from "./Pages/CookiesPolicy";
import EditRide from "./Pages/EditRide";
import Help from "./Pages/Help";
import Homepage from "./Pages/Homepage";
import IndividualRide from "./Pages/IndividualRide";
import Login from "./Pages/Login";
import MyRidesRedirect from "./Pages/MyRidesRedirect";
import OurMission from "./Pages/OurMission";
import PrivacyPolicy from "./Pages/PrivacyPolicy";
import PublicProfile from "./Pages/PublicProfile";
import Recovery from "./Pages/Recovery";
import Results from "./Pages/Results";
import SignUp from "./Pages/SignUp";
import TermsofUse from "./Pages/TermsOfUse";
import UserProfile from "./Pages/UserProfile";
import PaymentSuccess from "./Payments/PaymentSuccess";
import SplitRideConfirm from "./Payments/SplitRideConfirm";
import "./i18n";
import { supabase } from "./supabaseClient";

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const hash = window.location.hash;

      const isAtEntryPage = hash.includes("login") || hash.includes("signup");

      const isRecovery = hash.includes("recovery");

      // ✅ Only redirect if NOT on recovery page
      if (
        event === "SIGNED_IN" &&
        session?.user &&
        isAtEntryPage &&
        !isRecovery
      ) {
        navigate("/homepage", { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <AuthProvider>
      <div className="full-width-nav">
        <Navbar />
      </div>

      <div className="app-content">
        <Routes>
          <Route
            path="/"
            element={
              <>
                {/* <SearchBar /> */}
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
          <Route path="/profile/:id" element={<PublicProfile />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/results" element={<Results />} />
          <Route path="*" element={<Navigate to="/" />} />
          <Route path="/all-rides" element={<AllPostedRides />} />
          <Route path="/individual-ride/:id" element={<IndividualRide />} />
          <Route path="/my-rides" element={<MyRidesRedirect />} />
          <Route path="/edit-ride/:rideId" element={<EditRide />} />
          <Route path="/recovery" element={<Recovery />} />
          {/* Terms and Conditions */}
          <Route path="/Termsofuse" element={<TermsofUse />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cookies" element={<CookiesPolicy />} />
          {/* Help */}
          <Route path="/help" element={<Help />} />
          {/* Redirects */}
          {/* Payments */}
          <Route
            path="/splitride-confirm/:rideId"
            element={<SplitRideConfirm />}
          />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          {/* Messaging */}
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:chatId" element={<MessagesPage />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
