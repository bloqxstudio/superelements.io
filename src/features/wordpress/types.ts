import type { WordPressSite } from './rest'

/** O WordPress do cliente ligado a um projeto, com a senha de aplicação aprovada lá. */
export interface WordPressConnection {
  site: WordPressSite
  userLogin: string
  /** Senha de aplicação criada na aprovação. Fica no projeto, na conta; desconectar revoga no site. */
  password: string
  /** Id da senha no WordPress, para revogar ao desconectar. */
  passwordUuid?: string
  user: { id: number; name: string; roles: string[] }
  can: {
    editPages: boolean
    publishPages: boolean
    uploadFiles: boolean
    /** Sem ela, o WordPress filtra o HTML ao gravar e tira os scripts dos widgets HTML. Conexões antigas não têm. */
    unfilteredHtml?: boolean
    /** Configurações do site (ícone, por exemplo): só administrador. Conexões antigas não têm. */
    manageOptions?: boolean
  }
  connectedAt: number
  /** Última vez que a senha foi conferida no site. */
  checkedAt: number
}
