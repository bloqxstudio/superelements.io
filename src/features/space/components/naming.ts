import { create } from 'zustand'

/** O componente recém-criado: o painel dele abre com o campo do nome selecionado, pronto para digitar. */
export const useComponentNaming = create<{ id: string | null; set: (id: string | null) => void }>((set) => ({
  id: null,
  set: (id) => set({ id }),
}))
