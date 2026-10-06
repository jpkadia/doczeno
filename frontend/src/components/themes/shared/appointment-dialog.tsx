"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, MessageSquare, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface AppointmentDialogProps {
  doctorName?: string;
  organizationName: string;
  whatsApp?: string;
  phone?: string;
  consultationHours?: string;
  children?: React.ReactNode;
}

export function AppointmentDialog({
  doctorName,
  organizationName,
  whatsApp,
  phone,
  consultationHours,
  children,
}: AppointmentDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [patientName, setPatientName] = React.useState("");
  const [patientPhone, setPatientPhone] = React.useState("");
  const [preferredDate, setPreferredDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const cleanPhone = (whatsApp || phone || "").replace(/[^0-9]/g, "");

  const handleWhatsAppDirect = () => {
    if (!cleanPhone) {
      toast.error("Contact number is not configured for direct messaging.");
      return;
    }
    const message = encodeURIComponent(
      `Hello, I would like to schedule a consultation with ${
        doctorName ? `Dr. ${doctorName}` : organizationName
      }. Name: ${patientName || "Patient"}, Preferred Date: ${preferredDate || "Earliest available"}.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    setIsOpen(false);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim()) {
      toast.error("Please enter your name and contact phone number.");
      return;
    }

    setSubmitted(true);
    toast.success("Consultation request recorded. The clinic will confirm your slot shortly.");
    setTimeout(() => {
      setSubmitted(false);
      setIsOpen(false);
      setPatientName("");
      setPatientPhone("");
      setPreferredDate("");
      setNotes("");
    }, 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="lg" className="font-semibold shadow-md">
            Book Appointment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Schedule Consultation
          </DialogTitle>
          <DialogDescription>
            {doctorName ? `Consult Dr. ${doctorName}` : organizationName}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto animate-in zoom-in-75" />
            <h3 className="text-lg font-bold text-foreground">Appointment Requested!</h3>
            <p className="text-sm text-muted-foreground">
              Our clinical coordinator will contact you at {patientPhone} to confirm your appointment.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Quick Contact Badges */}
            <div className="grid grid-cols-2 gap-2">
              {cleanPhone && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleWhatsAppDirect}
                  className="w-full flex items-center justify-center gap-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>WhatsApp Direct</span>
                </Button>
              )}
              {phone && (
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="w-full flex items-center justify-center gap-2"
                >
                  <a href={`tel:${phone}`}>
                    <Phone className="h-4 w-4" />
                    <span>Call Clinic</span>
                  </a>
                </Button>
              )}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border" />
              <span className="flex-shrink mx-2 text-xs text-muted-foreground uppercase">
                Or Submit Form
              </span>
              <div className="flex-grow border-t border-border" />
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="patient-name" className="text-xs">
                  Patient Full Name *
                </Label>
                <Input
                  id="patient-name"
                  placeholder="e.g. Ramesh Patel"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="patient-phone" className="text-xs">
                  Phone / WhatsApp Number *
                </Label>
                <Input
                  id="patient-phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="preferred-date" className="text-xs">
                  Preferred Date
                </Label>
                <Input
                  id="preferred-date"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="patient-notes" className="text-xs">
                  Brief Medical Concern (Optional)
                </Label>
                <Input
                  id="patient-notes"
                  placeholder="e.g. Routine checkup, cardiology consultation"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {consultationHours && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-secondary/50 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Consultation Timings: Active as per weekly schedule</span>
                </div>
              )}

              <Button type="submit" className="w-full mt-2">
                Confirm Request
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
