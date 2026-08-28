"use client";

import React from "react";
import { signIn } from "next-auth/react";

export default function SignInPage(): React.ReactElement {
  return (
    <main>
      <h1>Sign In</h1>
      <button
        type="button"
        onClick={() => void signIn("github")}
      >
        Sign in with GitHub
      </button>
    </main>
  );
}
