import { supabase } from '../supabase'

export const saveTransaction = async ({ type, amount, description, userId }) => {
  const { data, error } = await supabase.from('transactions').insert([
    {
      type,
      amount,
      description,
      user_id: userId
    }
  ])

  if (error) {
    console.error(error)
    throw error
  }

  return data
}