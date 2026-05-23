interface LogoSpinnerProps {
  size?: number;
  className?: string;
}

export default function LogoSpinner({ size = 40, className = "" }: LogoSpinnerProps) {
  return (
    <img
      src="/logo.png"
      alt="Loading"
      width={size}
      height={size}
      className={`rounded-full animate-spin-slow ${className}`}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
