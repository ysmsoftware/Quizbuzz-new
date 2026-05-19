import { z } from "zod";


const emailField = z
  .string()
  .email("Invalid email address")
  .toLowerCase()
  .trim();

const phoneField = z
  .preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (typeof val !== "string") return val;
    let clean = val.replace(/[\s\-\(\)]/g, ""); // remove spaces, dashes, parentheses
    if (/^\d{10}$/.test(clean)) {
      // 10 digits without country code -> default to India (+91)
      clean = `+91${clean}`;
    } else if (/^91\d{10}$/.test(clean)) {
      // 91 with 10 digits without + -> prefix +
      clean = `+${clean}`;
    } else if (/^[1-9]\d{6,14}$/.test(clean)) {
      // starts with non-zero digit but has no + -> prefix +
      clean = `+${clean}`;
    }
    return clean;
  }, z.string().optional())
  .refine(
    (val) => val === undefined || /^\+[1-9]\d{6,14}$/.test(val),
    "Phone must be in E.164 format, e.g. +919876543210"
  );

const nameField = (label: string) =>
  z.string().min(1, `${label} is required`).max(100).trim();

const optionalStringField = (max = 150) =>
  z.string().max(max).trim().optional();


export const CreateContactSchema = z.object({
  email:      emailField,
  phone:      phoneField,
  firstName:  nameField("First name"),
  lastName:   optionalStringField(100),
  college:    optionalStringField(200),
  department: optionalStringField(150),
  city:       optionalStringField(100),
  state:      optionalStringField(100),
});

export const UpdateContactSchema = z.object({
  phone:      phoneField,
  firstName:  z.string().min(1).max(100).trim().optional(),
  lastName:   optionalStringField(100),
  college:    optionalStringField(200),
  department: optionalStringField(150),
  city:       optionalStringField(100),
  state:      optionalStringField(100),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "At least one field must be provided for update" }
);

export const ListContactsQuerySchema = z.object({
  search:  z.string().trim().optional(),
  city:    z.string().trim().optional(),
  state:   z.string().trim().optional(),
  college: z.string().trim().optional(),
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
});



export type CreateContactInput  = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput  = z.infer<typeof UpdateContactSchema>;
export type ListContactsQuery   = z.infer<typeof ListContactsQuerySchema>;