import LogoSpinner from "@/components/LogoSpinner";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <LogoSpinner size={56} />
    </div>
  );
}
