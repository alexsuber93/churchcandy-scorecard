/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cc: {
          blue:        '#2F2F8F',
          'blue-dark': '#22226B',
          'blue-mid':  '#3A3AAA',
          orange:      '#FF7A1A',
          'orange-dk': '#E06010',
          gray:        '#F2F2F2',
        },
      },
    },
  },
  plugins: [],
};
