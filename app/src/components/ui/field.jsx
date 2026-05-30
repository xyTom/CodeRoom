import * as React from "react";

import { cn } from "@/lib/utils";

const FieldGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="field-group" className={cn("flex flex-col gap-4", className)} {...props} />
));
FieldGroup.displayName = "FieldGroup";

const Field = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="field" className={cn("grid gap-2", className)} {...props} />
));
Field.displayName = "Field";

const FieldLabel = React.forwardRef(({ className, ...props }, ref) => (
  <label ref={ref} data-slot="field-label" className={cn("text-sm font-medium leading-none", className)} {...props} />
));
FieldLabel.displayName = "FieldLabel";

const FieldDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} data-slot="field-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
));
FieldDescription.displayName = "FieldDescription";

export { Field, FieldGroup, FieldLabel, FieldDescription };
