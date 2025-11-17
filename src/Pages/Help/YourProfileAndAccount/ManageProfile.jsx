import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../HelpArticleLayout";

const page = {
  title: "Managing Your Profile — TabFair",
  description: "Update your photo, contact info, and preferences.",
  canonical: "https://www.tabfair.com/help/account/manage-profile",
  published: "2025-08-19",
  modified: "2025-08-19",
};

export default function ManageProfile() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Managing Your Profile" },
  ];

  const webPageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: page.canonical,
    inLanguage: "en-GB",
    datePublished: page.published,
    dateModified: page.modified,
  };

  return (
    <>
      <Helmet>
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={page.canonical} />
        <script type="application/ld+json">{JSON.stringify(webPageLd)}</script>
      </Helmet>

      <HelpArticleLayout
        title="Managing Your Profile"
        description="Update your photo, contact info, and preferences."
        breadcrumb={breadcrumbItems}
      >
        <p>To manage your profile:</p>
        <ol>
          <li>Log in to your account.</li>
          <li>Click on your profile picture in the top-right corner.</li>
          <li>
            Select <strong>"My Account"</strong> from the dropdown menu.
          </li>
          <li>
            Here you can update your name, photo, bio, contact number, and more.
          </li>
          <li>Click "Save Changes" when you're done.</li>
        </ol>
        <p>
          Profile updates are instant, but you may need to refresh the page.
        </p>
      </HelpArticleLayout>
    </>
  );
}
