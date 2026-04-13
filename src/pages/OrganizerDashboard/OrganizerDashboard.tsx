import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, AppUser } from '../../types'

export default function OrganizerDashboard() {
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
    const [title, setTitle] = useState<string>('')
    const navigate = useNavigate()

    const fetchMyTournaments = async () => {
        const userString = localStorage.getItem('user')
        if (!userString) return
        const user: AppUser = JSON.parse(userString)

        const { data } = await supabase.from('tournaments').select('*').eq('organizer_id', user.id)
        if (data) setTournaments(data as Tournament[])
    }

    useEffect(() => {
        fetchMyTournaments()
    }, [])

    const handleCreate = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const userString = localStorage.getItem('user')
        if (!userString) return
        const user: AppUser = JSON.parse(userString)

        await supabase.from('tournaments').insert([
            { title, organizer_id: user.id }
        ])
        setIsModalOpen(false)
        setTitle('')
        fetchMyTournaments()
    }

    return (
        <div>
            <h1>Мои турниры</h1>
            <button onClick={() => setIsModalOpen(true)}>Создать турнир</button>

            <div>
                {tournaments.map(t => (
                    <div key={t.id}>
                        <h3>{t.title}</h3>
                        <button onClick={() => navigate(`/admin/manage/${t.id}`)}>Управление</button>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div>
                    <h2>Новый турнир</h2>
                    <form onSubmit={handleCreate}>
                        <input
                            type="text"
                            placeholder="Название турнира"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                        <button type="submit">Создать</button>
                        <button type="button" onClick={() => setIsModalOpen(false)}>Отмена</button>
                    </form>
                </div>
            )}
        </div>
    )
}