export type Category = 'All' | 'Kurdish' | 'Arabic' | 'General' | 'News' | 'Sports' | 'Movies' | 'Radio' | 'Islamic' | 'Kids';

export interface Channel {
  id: string;
  name: string;
  logo: string;
  categories: Category[];
  streamUrl?: string;
}

export type Language = 'Kurdish' | 'Arabic' | 'English' | 'Badini';
