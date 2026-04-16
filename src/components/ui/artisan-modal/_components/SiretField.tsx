"use client"

import { Controller, type Control } from "react-hook-form"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { validateSiret, siretFormRule } from "@/lib/siret-validation"

const labelClass = "text-xs font-medium text-foreground/80"
const slotClass = "!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0"
const slotClassLast = "!w-[calc(100%/5)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0"

type Props = {
  control: Control<any>
  name?: string
}

export function SiretField({ control, name = "siret" }: Props) {
  return (
    <div className="space-y-1 overflow-hidden">
      <Label htmlFor="siret" className={labelClass}>SIRET</Label>
      <Controller
        name={name}
        control={control}
        rules={{ validate: siretFormRule }}
        render={({ field, fieldState }) => {
          const siretValue = field.value?.replace(/\s/g, "") || ""
          const siretValidation = validateSiret(siretValue)
          const isSiretValid = siretValidation.isValid && siretValue.length === 14

          return (
            <div className="space-y-1 w-full overflow-hidden">
              <div className="flex items-center gap-1 w-full overflow-hidden">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <InputOTP
                    maxLength={14}
                    pattern={REGEXP_ONLY_DIGITS}
                    value={field.value}
                    onChange={(value) => field.onChange(value.replace(/\s/g, ""))}
                    onPaste={(e) => {
                      e.preventDefault()
                      const pastedText = e.clipboardData.getData("text/plain")
                      const cleaned = pastedText.replace(/\s/g, "").slice(0, 14)
                      field.onChange(cleaned)
                    }}
                    containerClassName="flex flex-nowrap items-center w-full"
                    className="gap-0 w-full"
                    pushPasswordManagerStrategy="none"
                  >
                    <InputOTPGroup className="gap-0 flex-1 min-w-0">
                      <InputOTPSlot index={0} className={slotClass} />
                      <InputOTPSlot index={1} className={slotClass} />
                      <InputOTPSlot index={2} className={slotClass} />
                    </InputOTPGroup>
                    <span className="text-muted-foreground text-[8px] shrink-0 px-px">·</span>
                    <InputOTPGroup className="gap-0 flex-1 min-w-0">
                      <InputOTPSlot index={3} className={slotClass} />
                      <InputOTPSlot index={4} className={slotClass} />
                      <InputOTPSlot index={5} className={slotClass} />
                    </InputOTPGroup>
                    <span className="text-muted-foreground text-[8px] shrink-0 px-px">·</span>
                    <InputOTPGroup className="gap-0 flex-1 min-w-0">
                      <InputOTPSlot index={6} className={slotClass} />
                      <InputOTPSlot index={7} className={slotClass} />
                      <InputOTPSlot index={8} className={slotClass} />
                    </InputOTPGroup>
                    <span className="text-muted-foreground text-[8px] shrink-0 px-px">·</span>
                    <InputOTPGroup className="gap-0 flex-[1.67] min-w-0">
                      <InputOTPSlot index={9} className={slotClassLast} />
                      <InputOTPSlot index={10} className={slotClassLast} />
                      <InputOTPSlot index={11} className={slotClassLast} />
                      <InputOTPSlot index={12} className={slotClassLast} />
                      <InputOTPSlot index={13} className={slotClassLast} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {siretValue.length > 0 && (
                  isSiretValid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  ) : siretValue.length === 14 ? (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : null
                )}
              </div>
              {fieldState.error && (
                <p className="text-xs text-destructive">{fieldState.error.message}</p>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}
