import React from "react";
import HelpArticleLayout from "../HelpArticleLayout";

export default function CreatingAccount() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Creating an Account" },
  ];

  return (
    <HelpArticleLayout
      title="Creating an Account"
      description="Learn how to get started with your ShareRide profile."
      breadcrumb={breadcrumb}
    >
      <ol>
        <li>
          Go to the <a href="/register">registration page</a>.
        </li>
        <li>Fill in your name, email, and create a password.</li>
        <li>Click "Sign Up" and check your email for a verification link.</li>
        <li>Once verified, you can log in and complete your profile.</li>
      </ol>
      <p>
        Need help? <a href="/contact-support">Contact support</a>.
      </p>
    </HelpArticleLayout>
  );
}
