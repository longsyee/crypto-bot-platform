import { useRef, useCallback, useEffect, type KeyboardEvent } from "react";

interface OtpInputProps {
  value: string[];
  onChange: (index: number, value: string) => void;
  error?: string;
  onComplete?: (code: string) => void;
}

export function OtpInput({ value, onChange, error, onComplete }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, "").slice(0, 1);
      if (val === "" && value[index] !== "") {
        onChange(index, "");
        return;
      }
      onChange(index, val);
      if (val && index < 5) {
        refs.current[index + 1]?.focus();
      }
      if (val && index === 5 && onComplete) {
        const next = [...value];
        next[index] = val;
        onComplete(next.join(""));
      }
    },
    [value, onChange, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !value[index] && index > 0) {
        refs.current[index - 1]?.focus();
      }
    },
    [value]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const paste = (e.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);
      paste.split("").forEach((ch, i) => {
        if (refs.current[i]) {
          onChange(i, ch);
        }
      });
      if (refs.current[paste.length - 1]) {
        refs.current[paste.length - 1]?.focus();
      }
      if (paste.length === 6 && onComplete) {
        onComplete(paste);
      }
    },
    [onChange, onComplete]
  );

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            autoComplete={i === 0 ? "one-time-code" : undefined}
            value={value[i]}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={`auth-otp-box ${error ? "auth-otp-error" : ""}`}
            aria-label={`OTP digit ${i + 1}`}
          />
        ))}
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
