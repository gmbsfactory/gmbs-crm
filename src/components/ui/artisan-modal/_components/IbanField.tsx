"use client"

import React from "react"
import { Controller, type Control } from "react-hook-form"
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { CheckCircle2, AlertCircle, Landmark } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { validateIban, ibanFormRule, IBAN_LENGTH, IBAN_GROUPS } from "@/lib/iban-validation"

type Props = {
  control: Control<any>
  name?: string
}

export function IbanField({ control, name = "iban" }: Props) {
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Landmark className="h-4 w-4" />
          IBAN
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 overflow-hidden">
        <Controller
          name={name}
          control={control}
          rules={{ validate: ibanFormRule }}
          render={({ field, fieldState }) => {
            const ibanValue = field.value?.replace(/\s/g, "").toUpperCase() || ""
            const ibanResult = validateIban(ibanValue)
            const isIbanComplete = ibanValue.length === IBAN_LENGTH
            const isIbanValid = ibanResult.isValid && isIbanComplete

            return (
              <div className="space-y-1 w-full overflow-hidden">
                <div className="flex items-center gap-1 w-full overflow-hidden">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <InputOTP
                      maxLength={IBAN_LENGTH}
                      pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                      inputMode="text"
                      value={field.value}
                      onChange={(value) => field.onChange(value.replace(/\s/g, "").toUpperCase())}
                      onPaste={(e) => {
                        e.preventDefault()
                        const pastedText = e.clipboardData.getData("text/plain")
                        const cleaned = pastedText.replace(/\s/g, "").toUpperCase().slice(0, IBAN_LENGTH)
                        field.onChange(cleaned)
                      }}
                      containerClassName="flex flex-nowrap items-center w-full"
                      className="gap-0 w-full"
                      pushPasswordManagerStrategy="none"
                    >
                      {IBAN_GROUPS.map((size, groupIndex) => {
                        const startIndex = IBAN_GROUPS.slice(0, groupIndex).reduce(
                          (sum, groupSize) => sum + groupSize,
                          0
                        )
                        return (
                          <React.Fragment key={`iban-group-${groupIndex}`}>
                            <InputOTPGroup className="gap-0 flex-1 min-w-0">
                              {Array.from({ length: size }).map((_, slotIndex) => (
                                <InputOTPSlot
                                  key={`iban-slot-${startIndex + slotIndex}`}
                                  index={startIndex + slotIndex}
                                  className="!w-[calc(100%/4)] !max-w-[18px] h-6 text-[9px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0"
                                />
                              ))}
                            </InputOTPGroup>
                            {groupIndex < IBAN_GROUPS.length - 1 && (
                              <span className="text-muted-foreground text-[8px] shrink-0 px-px">·</span>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </InputOTP>
                  </div>
                  {ibanValue.length > 0 && (
                    isIbanValid ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    ) : isIbanComplete ? (
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
      </CardContent>
    </Card>
  )
}
