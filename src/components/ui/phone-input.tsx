import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value = "", onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Format phone number with Brazilian mask: +55 (XX) XXXXX-XXXX
    const formatPhoneNumber = (input: string) => {
      // Remove all non-digits
      const digits = input.replace(/\D/g, "");
      
      // Limit to 13 digits (2 for country + 11 for Brazilian number)
      const limitedDigits = digits.slice(0, 13);
      
      if (limitedDigits.length === 0) return "";
      if (limitedDigits.length <= 2) return `+${limitedDigits}`;
      if (limitedDigits.length <= 4) return `+${limitedDigits.slice(0, 2)} (${limitedDigits.slice(2)}`;
      if (limitedDigits.length <= 9) return `+${limitedDigits.slice(0, 2)} (${limitedDigits.slice(2, 4)}) ${limitedDigits.slice(4)}`;
      
      return `+${limitedDigits.slice(0, 2)} (${limitedDigits.slice(2, 4)}) ${limitedDigits.slice(4, 9)}-${limitedDigits.slice(9)}`;
    };

    // Get clean phone number (only digits)
    const getCleanValue = (formatted: string) => {
      return formatted.replace(/\D/g, "");
    };

    React.useEffect(() => {
      if (value) {
        setDisplayValue(formatPhoneNumber(value));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formatted = formatPhoneNumber(inputValue);
      const clean = getCleanValue(formatted);
      
      setDisplayValue(formatted);
      onChange?.(clean);
    };

    return (
      <Input
        ref={ref}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        placeholder="+55 (11) 99999-9999"
        className={cn(className)}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };