import { useEffect } from "react";
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
import Help from "./Pages/Help/Help";
import PassengerHelp from "./Pages/Help/Passenger/PassengerHelpMain";
import InvoicesAndReceipts from "./Pages/Help/Passenger/Payments, Pricing and Refunds/InvoicesAndReceipts";
import PayingForARide from "./Pages/Help/Passenger/Payments, Pricing and Refunds/PayingForARide";
import Pricing from "./Pages/Help/Passenger/Payments, Pricing and Refunds/Pricing";
import RefundsAndExchanges from "./Pages/Help/Passenger/Payments, Pricing and Refunds/RefundsAndExhanges";
import BookingRequestsAndConfirmation from "./Pages/Help/Passenger/SearchingAndBooking/BookingRequestsAndConfirmation";
import CommunicatingWithDrivers from "./Pages/Help/Passenger/SearchingAndBooking/CommunicatingWithDrivers";
import HowToBook from "./Pages/Help/Passenger/SearchingAndBooking/HowToBook";
import Luggage from "./Pages/Help/Passenger/SearchingAndBooking/Luggage";
import Requirements from "./Pages/Help/Passenger/SearchingAndBooking/Requirements";
import SearchTips from "./Pages/Help/Passenger/SearchingAndBooking/SearchTips";
import Cancellations from "./Pages/Help/Passenger/YourBookings/Cancellations";
import ChangeBooking from "./Pages/Help/Passenger/YourBookings/ChangeBooking";
import FindBooking from "./Pages/Help/Passenger/YourBookings/FindBooking";
import LostItem from "./Pages/Help/Passenger/YourBookings/LostItem";
import PostRide from "./Pages/Help/Passenger/YourBookings/PostRide";
import PreparingToTravel from "./Pages/Help/Passenger/YourBookings/PreparingToTravel";
import Troubleshooting from "./Pages/Help/Passenger/YourBookings/Troubleshooting";
import AccountSecurityHelp from "./Pages/Help/YourProfileAndAccount/AccountSecurity";
import CreatingAccount from "./Pages/Help/YourProfileAndAccount/CreatingAccount";
import AccountHelp from "./Pages/Help/YourProfileAndAccount/HelpAccount";
import RatingsHelp from "./Pages/Help/YourProfileAndAccount/HelpRatings";
import LoginTroubleshooting from "./Pages/Help/YourProfileAndAccount/HelpTroubleshooting";
import ManageProfile from "./Pages/Help/YourProfileAndAccount/ManageProfile";
import DeleteProfileHelp from "./Pages/Help/YourProfileAndAccount/Managing Your Account/FilesInside/DeteleProfile";
import EditProfileHelp from "./Pages/Help/YourProfileAndAccount/Managing Your Account/FilesInside/EditProfile";
import NotificationsHelp from "./Pages/Help/YourProfileAndAccount/Managing Your Account/FilesInside/Notifications";
import ManageAccountOverview from "./Pages/Help/YourProfileAndAccount/Managing Your Account/ManagingYourAccount";
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
import TokenViewer from "./Pages/TokenViewer";
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
        <Navbar variant="solid" />
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
          {/* 1. Passenger */}
          <Route path="/help/passenger" element={<PassengerHelp />} />
          {/* 1.1 SUBLINKS Searching And Booking */}
          <Route path="/help/passenger/search-tips" element={<SearchTips />} />
          <Route path="/help/passenger/how-to-book" element={<HowToBook />} />
          <Route
            path="/help/passenger/requirements"
            element={<Requirements />}
          />
          <Route
            path="/help/passenger/booking-confirmation"
            element={<BookingRequestsAndConfirmation />}
          />
          <Route
            path="/help/passenger/communicating-drivers"
            element={<CommunicatingWithDrivers />}
          />
          <Route path="/help/passenger/luggage" element={<Luggage />} />
          {/* 1.2 SUBLINKS Payments, Pricing and Refunds */}
          <Route
            path="/help/passenger/payment-methods"
            element={<PayingForARide />}
          />
          <Route path="/help/passenger/pricing" element={<Pricing />} />
          <Route
            path="/help/passenger/refunds"
            element={<RefundsAndExchanges />}
          />
          <Route
            path="/help/passenger/invoices"
            element={<InvoicesAndReceipts />}
          />
          {/* 1.3 SUBLINKS Your Bookings */}

          <Route
            path="/help/passenger/find-booking"
            element={<FindBooking />}
          />
          <Route
            path="/help/passenger/cancellations"
            element={<Cancellations />}
          />
          <Route
            path="/help/passenger/change-booking"
            element={<ChangeBooking />}
          />
          <Route
            path="/help/passenger/preparing-travel"
            element={<PreparingToTravel />}
          />
          <Route path="/help/passenger/post-ride" element={<PostRide />} />
          <Route path="/help/passenger/lost-item" element={<LostItem />} />
          <Route
            path="/help/passenger/troubleshooting"
            element={<Troubleshooting />}
          />

          {/* Driver */}
          {/*  */}
          {/* Help Your Profile And Account */}
          <Route path="/help/account" element={<AccountHelp />} />
          <Route
            path="/help/account/creating-account"
            element={<CreatingAccount />}
          />
          <Route
            path="/help/account/manage-profile"
            element={<ManageProfile />}
          />
          <Route
            path="/help/account/login-troubleshooting"
            element={<LoginTroubleshooting />}
          />
          <Route path="/help/account/ratings" element={<RatingsHelp />} />
          <Route
            path="/help/account/managing-your-account"
            element={<ManageAccountOverview />}
          />
          <Route
            path="/help/account/notifications"
            element={<NotificationsHelp />}
          />
          <Route
            path="/help/account/edit-profile"
            element={<EditProfileHelp />}
          />
          <Route
            path="/help/account/delete-profile"
            element={<DeleteProfileHelp />}
          />
          <Route
            path="/help/account/account-security"
            element={<AccountSecurityHelp />}
          />
          {/* DELETE */}
          <Route path="/token-viewer" element={<TokenViewer />} />
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
