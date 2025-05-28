import { Suspense } from "react";
import "./App.css";
import Navbar from "./Components/Navbar";
import Homepage from "./Pages/Homepage";
import "./i18n";

function App() {
  return (
    <Suspense fallback="Loading...">
      <Navbar />
      {/* ... rest of your app */}
      <Homepage />
    </Suspense>
  );
}

export default App;
