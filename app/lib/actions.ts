'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { z } from 'zod'; // TypeScript-first validation library
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
      invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
  });

// Use Zod to update the expected types
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// This is temporary until @types/react-dom is updated
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    
    /*
    const rawFormData = {
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    };
    // Test it out:
    console.log(rawFormData); // Since server-side, logs to VSCode terminal
    console.log(typeof rawFormData.amount); // Since server-side, logs to VSCode terminal
    */

    /* See also const rawFormData = Object.fromEntries(formData.entries()) Chapter 12 - Mutating Data */

    /*
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    */

    // Validate form fields using Zod
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
      };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100; // Good practice to store monetary values in cents in your database to eliminate JavaScript floating-point errors.
    const date = new Date().toISOString().split('T')[0]; // Create a new date with the format "YYYY-MM-DD" for the invoice's creation date.
    //console.log(date.toString()); // Since server-side, logs to VSCode terminal

    // Insert data into the database
    try {
      await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `;
    } catch (error) {
      // If a database error occurs, return a more specific error
      return {
        message: 'Database Error: Failed to Create Invoice.',
      };
    }

    // Revalidate the cache for the invoices page and redirect the user.
    // Since we are updating the data displayed in the invoices route, we must clear the cache and trigger a new request to the server.
    // The changes to the database will then be displayed: otherwise what is displayed comes from the cache.
    revalidatePath('/dashboard/invoices');

    // Redirect user back to the dashboard/invoices route
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    const amountInCents = amount * 100; // Good practice to store monetary values in cents in your database to eliminate JavaScript floating-point errors.
   
    try {
      await sql`
          UPDATE invoices
          SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
          WHERE id = ${id}
        `;
    } catch (error) {
      return { message: 'Database Error: Failed to Update Invoice.' };
    }

    // Since we are updating the data displayed in the invoices route, we must clear the cache and trigger a new request to the server.
    // The changes to the database will then be displayed: otherwise what is displayed comes from the cache.
    revalidatePath('/dashboard/invoices');
    
    // Redirect user back to the dashboard/invoices route
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {

    //throw new Error('Failed to Delete Invoice');

    // Since this action is being called in the /dashboard/invoices path, you don't need to call redirect.
    // Calling revalidatePath will trigger a new server request and re-render the table.
    try {
      await sql`DELETE FROM invoices WHERE id = ${id}`;
      revalidatePath('/dashboard/invoices');
      return { message: 'Deleted Invoice.' };
    } catch (error) {
      return { message: 'Database Error: Failed to Delete Invoice.' };
    }
}