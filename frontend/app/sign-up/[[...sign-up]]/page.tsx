import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <SignUp
        afterSignUpUrl="/onboarding"
        appearance={{
          variables: {
            colorBackground: "#F7F1E1",
            colorPrimary: "#A8791B",
            colorText: "#232936",
            colorTextSecondary: "#66707F",
            colorInputBackground: "#FBF7EB",
            colorInputText: "#232936",
            borderRadius: "0px",
          },
        }}
      />
    </div>
  );
}
