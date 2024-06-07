'use server';

import { z } from 'zod'; // TypeScript-first validation library
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid']),
    date: z.string(),
  });

// Use Zod to update the expected types
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    
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

    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    const amountInCents = amount * 100; // Good practice to store monetary values in cents in your database to eliminate JavaScript floating-point errors.
    const date = new Date().toISOString().split('T')[0]; // Create a new date with the format "YYYY-MM-DD" for the invoice's creation date.
    //console.log(date.toString()); // Since server-side, logs to VSCode terminal

    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;

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
   
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;

    // Since we are updating the data displayed in the invoices route, we must clear the cache and trigger a new request to the server.
    // The changes to the database will then be displayed: otherwise what is displayed comes from the cache.
    revalidatePath('/dashboard/invoices');
    
    // Redirect user back to the dashboard/invoices route
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {

    // Since this action is being called in the /dashboard/invoices path, you don't need to call redirect.
    // Calling revalidatePath will trigger a new server request and re-render the table.
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
}