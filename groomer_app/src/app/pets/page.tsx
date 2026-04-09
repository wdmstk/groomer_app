import { redirect } from 'next/navigation'

export default function PetsPage() {
  redirect('/customers/manage?view=pets')
}
