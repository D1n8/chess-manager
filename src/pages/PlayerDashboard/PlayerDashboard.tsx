import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, AppUser } from '../../types'

export default function PlayerDashboard() {
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
    const navigate = useNavigate()
    
    const fetchTournaments = async () => {
        const { data } = await supabase.from('tournaments').select('*')
        if (data) setTournaments(data as Tournament[])
    }

    useEffect(() => {
        fetchTournaments()
    }, [])


    const handleJoin = async () => {
        if (!selectedTournament) return
        const userString = localStorage.getItem('user')
        if (!userString) return

        const user: AppUser = JSON.parse(userString)

        await supabase.from('participants').insert([
            { tournament_id: selectedTournament.id, player_id: user.id }
        ])

        const id = selectedTournament.id
        setSelectedTournament(null)
        navigate(`/tournaments/${id}`)
    }

    return (
        <div>
            <h1>Доступные турниры</h1>
            <div>
                {tournaments.map(t => (
                    <div key={t.id}>
                        <h3>{t.title}</h3>
                        <button onClick={() => setSelectedTournament(t)}>Записаться</button>
                        <button onClick={() => navigate(`/tournaments/${t.id}`)}>Просмотр</button>
                    </div>
                ))}
            </div>

            {selectedTournament && (
                <div>
                    <h2>Подтверждение</h2>
                    <p>Вы уверены, что хотите участвовать в {selectedTournament.title}?</p>
                    <button onClick={handleJoin}>Да, записаться</button>
                    <button onClick={() => setSelectedTournament(null)}>Отмена</button>
                </div>
            )}
        </div>
    )
}