export type Review = {
    title: string,
    description: string,
    is_active: boolean
}

export type ReviewRow = {
    title: string, 
    date_created: string, 
    owner: string, 
    articles: number, 
    id: number
}