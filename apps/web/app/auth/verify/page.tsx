import { Suspense } from "react";
import VerifyClient from "./verify-client";

export default function VerifyPage() {
  return (
    <main
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10"
      style={{ background: "#17191d" }}
    >
      <p className="text-sm font-bold" style={{ color: "#FFD000", letterSpacing: "0.06em" }}>
        SalesGeek Scotland
      </p>
      <h1 className="mt-3 text-3xl font-semibold" style={{ color: "#ffffff" }}>
        Secure sign in
      </h1>
      <Suspense fallback={<p className="mt-4 text-sm" style={{ color: "#c7c9d6" }}>Signing you in...</p>}>
        <VerifyClient />
      </Suspense>
    </main>
  );
}
