import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-opsblack">
      <SignIn
        afterSignInUrl="/dashboard"
        appearance={{
          variables: {
            colorBackground: "#0F1624",
            colorPrimary: "#E8A838",
            colorText: "#D4CEBC",
            colorTextSecondary: "#6B7280",
            colorInputBackground: "#0A0E1A",
            colorInputText: "#D4CEBC",
            borderRadius: "0px",
          },
        }}
      />
    </div>
  );
}
