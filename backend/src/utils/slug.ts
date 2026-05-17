import slugify from "slugify"

export const createSlug = (string: string): string => {
    
    let slugifyedString = slugify(string, {
        replacement: '-',
        remove: /[*+~.()'"!:@]/g,
        lower: true,
        strict: true,
        trim: true,
    })
    return slugifyedString
}


export const generateRandomString = (length: number): string  => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
