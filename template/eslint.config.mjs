import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Textes en français : les apostrophes dans le JSX sont normales.
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // INTERDIT : les éléments natifs du navigateur (ils ne suivent pas la charte du site).
      // Utiliser src/components/ui : Select, DatePicker, RadioCard, Checkbox, Switch, useConfirm.
      'no-restricted-syntax': ['error',
        { selector: "JSXOpeningElement[name.name='select']", message: 'Liste native interdite : utilise <Select> (components/ui/select).' },
        { selector: "JSXOpeningElement[name.name='datalist']", message: 'Liste native interdite : utilise <Select>.' },
        { selector: "JSXOpeningElement[name.name='dialog']", message: 'Fenêtre native interdite : utilise useConfirm (components/ui/dialog).' },
        { selector: "JSXAttribute[name.name='type'][value.value=/^(date|time|datetime-local|month|week)$/]", message: 'Calendrier natif interdit : utilise <DatePicker>.' },
        { selector: "JSXAttribute[name.name='type'][value.value=/^(radio|checkbox|color|range)$/]", message: 'Contrôle natif interdit : utilise RadioCard, Checkbox ou Switch (components/ui/choice).' },
        { selector: "JSXAttribute[name.name='type'][value.value='password']", message: 'Mot de passe sans œil : utilise <PasswordInput> (components/ui/password-input).' },
        { selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt|open)$/]", message: 'Fenêtre ou onglet du navigateur interdit : reste dans le design du site.' },
      ],
      'no-restricted-globals': ['error',
        ...['alert', 'confirm', 'prompt'].map((name) => ({ name, message: 'Fenêtre du navigateur interdite : utilise useConfirm (components/ui/dialog) ou un message dans la page.' })),
      ],
    },
  },
  { ignores: ['node_modules/**', '.next/**', '.next-dev/**', 'out/**', 'build/**', 'next-env.d.ts'] },
]

export default eslintConfig
