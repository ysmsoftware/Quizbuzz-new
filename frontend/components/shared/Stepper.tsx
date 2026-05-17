import { CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: number;
  title: string;
  description: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (stepId: number) => void;
  className?: string;
}

export function Stepper({ steps, currentStep, onStepChange, className }: StepperProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex-1 cursor-pointer"
            onClick={() => onStepChange(step.id)}
          >
            <div
              className={`w-full text-left pb-4 border-b-2 transition-colors ${
                currentStep >= step.id
                  ? 'border-primary'
                  : 'border-border/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : currentStep > step.id
                      ? 'bg-green-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">{step.description}</p>
                </div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="flex justify-center -mt-4">
                <ChevronRight className={`h-5 w-5 ${currentStep > step.id ? 'text-green-600' : 'text-muted-foreground'} translate-y-8`} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
