import Link from "next/link";
import { ArrowLeft, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface OnboardingDisabledNoticeProps {
  categoryLabel: string;
}

export function OnboardingDisabledNotice({
  categoryLabel,
}: OnboardingDisabledNoticeProps) {
  return (
    <Card className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg rounded-2xl max-w-xl mx-auto mt-8">
      <CardContent className="p-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <Ban className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-slate-900">
            {categoryLabel} is Currently Disabled
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            This onboarding form has been temporarily disabled by the platform administrator. Please return to the main options page to choose an active setup pathway.
          </p>
        </div>
        <div className="pt-2">
          <Button
            asChild
            className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Available Options
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
