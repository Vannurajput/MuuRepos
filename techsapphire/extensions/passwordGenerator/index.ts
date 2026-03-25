import { Extension } from '../types';

export const passwordGenerator: Extension = {
    id: 'password-generator',
    name: 'Password Generator',
    description: 'Generates a strong, random password.',
    execute: (context) => {
        context.showPasswordGenerator();
    }
};
