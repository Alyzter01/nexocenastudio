import {test,expect} from '@playwright/test';
test('cadastro, projeto vazio, autosave, restauração e interface mobile',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Ainda não tenho uma conta'}).click();
 await page.getByLabel('E-mail').fill(`browser-${crypto.randomUUID()}@example.com`);await page.getByLabel('Senha',{exact:true}).fill('strong-browser-password');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByRole('button',{name:'Novo projeto',exact:true}).click();await page.getByLabel('Nome do projeto').fill('História de homologação');await page.getByRole('button',{name:'Criar projeto',exact:true}).click();
 await expect(page.getByLabel('Roteiro',{exact:true})).toHaveValue('');await page.getByLabel('Roteiro',{exact:true}).fill('A primeira luz atravessa a cidade.');await page.getByRole('button',{name:'Adicionar',exact:true}).click();await page.getByLabel('Título',{exact:true}).fill('Primeira luz');
 await expect(page.locator('.save-state')).toHaveText('Sincronizado');await page.reload();await expect(page.getByLabel('Roteiro',{exact:true})).toHaveValue('A primeira luz atravessa a cidade.');await expect(page.getByLabel('Título',{exact:true})).toHaveValue('Primeira luz');
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Aprovar cena',exact:true})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/studio-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Projetos',exact:true}).click();await expect(page.getByRole('heading',{name:/Boas histórias/})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:/Boas histórias/})).toBeVisible();
});
