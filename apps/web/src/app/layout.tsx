import React from "react";
import { SessionProvider } from "next-auth/react";

export const metadata = {
  title: "KB — Knowledge Base",
  description: "AI-powered knowledge base",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
